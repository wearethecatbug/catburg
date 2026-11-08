"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { createRequire } = require("node:module");
const { resolve } = require("node:path");
const test = require("node:test");

const uiRequire = createRequire(resolve(__dirname, "../packages/ui/package.json"));
const turboPackage = uiRequire.resolve("@turbo/gen/package.json");
const turboRequire = createRequire(turboPackage);
const proxyAgent = turboRequire.resolve("proxy-agent");
const proxyRequire = createRequire(proxyAgent);
const pacProxyAgent = proxyRequire.resolve("pac-proxy-agent");
const pacRequire = createRequire(pacProxyAgent);
const getUri = pacRequire.resolve("get-uri");
const getUriRequire = createRequire(getUri);
const basicFtp = getUriRequire.resolve("basic-ftp");
const { Client } = getUriRequire("basic-ftp");

class FakeDataSocket extends EventEmitter {
  constructor(connections) {
    super();
    this.connections = connections;
  }

  setTimeout() {}

  connect(options, callback) {
    this.connections.push(options);
    queueMicrotask(callback);
    return this;
  }

  destroy() {}
}

function pasv(host, port = 2121) {
  const high = Math.floor(port / 256);
  const low = port % 256;
  return `227 Entering Passive Mode (${host.replaceAll(".", ",")},${high},${low})`;
}

function fakeFtp({ controlHost, pasvMessage }) {
  const commands = [];
  const connections = [];
  let socketCount = 0;
  const ftp = {
    socket: { remoteAddress: controlHost },
    timeout: 0,
    ipFamily: 4,
    tlsOptions: {},
    log() {},
    request(command) {
      commands.push(command);
      if (command === "EPSV") return Promise.reject(new Error("EPSV unavailable"));
      if (command === "PASV") return Promise.resolve({ message: pasvMessage });
      throw new Error(`Unexpected FTP command: ${command}`);
    },
    _newSocket() {
      socketCount += 1;
      return new FakeDataSocket(connections);
    },
  };
  return { ftp, commands, connections, socketCount: () => socketCount };
}

async function transfer(client, options) {
  const probe = fakeFtp(options);
  await client.prepareTransfer(probe.ftp);
  return probe;
}

async function rejectedTransfer(client, options, expected) {
  const probe = fakeFtp(options);
  await assert.rejects(client.prepareTransfer(probe.ftp), expected);
  assert.equal(probe.socketCount(), 0, "rejected PASV replies must not create a data socket");
  assert.deepEqual(probe.connections, [], "rejected PASV replies must not dial any host");
  return probe;
}

async function withClient(run) {
  const client = new Client();
  try {
    return await run(client);
  } finally {
    client.close();
  }
}

test("uses the installed @turbo/gen proxy/get-uri/basic-ftp chain", () => {
  assert.match(turboPackage, /@turbo[\\/]gen[\\/]package\.json$/);
  assert.match(proxyAgent, /proxy-agent[\\/]dist[\\/]index\.js$/);
  assert.match(pacProxyAgent, /pac-proxy-agent[\\/]dist[\\/]index\.js$/);
  assert.match(getUri, /get-uri[\\/]dist[\\/]index\.js$/);
  assert.match(basicFtp, /basic-ftp[\\/]dist[\\/]index\.js$/);
  const client = new Client();
  try {
    assert.equal(client.options.allowSeparateTransferHost, false);
  } finally {
    client.close();
  }
});

test("default strategy tries EPSV then PASV and caches the successful secure strategy", async () => {
  await withClient(async (client) => {
    const first = await transfer(client, {
      controlHost: "203.0.113.10",
      pasvMessage: pasv("203.0.113.10"),
    });
    assert.deepEqual(first.commands, ["EPSV", "PASV"]);
    assert.deepEqual(first.connections, [{ host: "203.0.113.10", port: 2121, family: 4 }]);

    const second = await transfer(client, {
      controlHost: "203.0.113.10",
      pasvMessage: pasv("203.0.113.10"),
    });
    assert.deepEqual(second.commands, ["PASV"]);
    assert.deepEqual(second.connections, [{ host: "203.0.113.10", port: 2121, family: 4 }]);
  });
});

for (const advertisedHost of [
  "10.0.0.0",
  "10.255.255.255",
  "172.16.0.0",
  "172.31.255.255",
  "192.168.0.0",
  "192.168.255.255",
]) {
  test(`public control accepts private PASV ${advertisedHost} but dials only control peer`, async () => {
    await withClient(async (client) => {
      const probe = await transfer(client, {
        controlHost: "203.0.113.10",
        pasvMessage: pasv(advertisedHost),
      });
      assert.deepEqual(probe.commands, ["EPSV", "PASV"]);
      assert.equal(probe.socketCount(), 1);
      assert.deepEqual(probe.connections, [{ host: "203.0.113.10", port: 2121, family: 4 }]);
    });
  });
}

test("retains loopback and IPv4-mapped control-peer compatibility", async () => {
  await withClient(async (client) => {
    const loopback = await transfer(client, {
      controlHost: "127.0.0.1",
      pasvMessage: pasv("127.0.0.2"),
    });
    assert.deepEqual(loopback.connections, [{ host: "127.0.0.1", port: 2121, family: 4 }]);
  });
  await withClient(async (client) => {
    const mapped = await transfer(client, {
      controlHost: "::ffff:203.0.113.10",
      pasvMessage: pasv("203.0.113.10"),
    });
    assert.deepEqual(mapped.connections, [{ host: "203.0.113.10", port: 2121, family: 4 }]);
  });
});

for (const advertisedHost of ["203.0.113.11", "172.15.0.1", "172.32.0.1"]) {
  test(`rejects separate public PASV host ${advertisedHost}`, async () => {
    await withClient((client) => rejectedTransfer(client, {
      controlHost: "203.0.113.10",
      pasvMessage: pasv(advertisedHost),
    }, /PASV returned another host/));
  });
}

test("rejects a private control peer with a different private PASV host", async () => {
  await withClient((client) => rejectedTransfer(client, {
    controlHost: "10.0.0.1",
    pasvMessage: pasv("10.0.0.2"),
  }, /PASV returned another host/));
});

test("rejects malformed PASV and disconnected controls before a data socket exists", async () => {
  await withClient((client) => rejectedTransfer(client, {
    controlHost: "203.0.113.10",
    pasvMessage: "227 malformed",
  }, /Can't parse response to 'PASV'/));
  await withClient((client) => rejectedTransfer(client, {
    controlHost: undefined,
    pasvMessage: pasv("10.0.0.1"),
  }, /Control socket is disconnected/));
});
