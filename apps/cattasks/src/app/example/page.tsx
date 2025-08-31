'use client';
import {type ParsedTask, parseTasksArr} from "@/app/_components/tasks/lib/ParseTasksArr";
import {useEffect, useState} from "react";

// let tasksW = `
// <!--Two tortoises named A and B must run a race. A starts with an average speed of 720 feet per hour. Young B knows she runs faster than A, and furthermore has not finished her cabbage.-->
//
// <!--When she starts, at last, she can see that A has a 70 feet lead but B's speed is 850 feet per hour. How long will it take B to catch A?-->
//
// <!--More generally: given two speeds v1 (A's speed, integer > 0) and v2 (B's speed, integer > 0) and a lead g (integer > 0) how long will it take B to catch A?-->
//
// <!--The result will be an array [hour, min, sec] which is the time needed in hours, minutes and seconds (round down to the nearest second) or a string in some languages.-->
//
// <!--If v1 >= v2 then return nil, nothing, null, None or {-1, -1, -1} for C++, C, Go, Nim, Pascal, COBOL, Erlang, [-1, -1, -1] for Perl,[] for Kotlin or "-1 -1 -1" for others.-->
//
// <!--Examples:-->
// <!--race(720, 850, 70) => [0, 32, 18] -->
// <!--race(80, 91, 37)   => [3, 21, 49] -->
// <!--Note:-->
// <!--See other examples in "Your test cases".-->
//
// <!--In Fortran - as in any other language - the returned string is not permitted to contain any redundant trailing whitespace: you can use dynamically allocated character strings.-->
//
// <!--** Hints for people who don't know how to convert to hours, minutes, seconds:-->
//
// <!--Tortoises don't care about fractions of seconds-->
// <!--Think of calculation by hand using only integers (in your code use or simulate integer division)-->
// <!--or Google: "convert decimal time to hours minutes seconds"-->
//
// <!--<html>-->
// <!--<head>-->
// <!--    <meta charset="UTF-8">- -->
// <!--</head>-->
// <!--<body>-->
// <!--<script>-->
// <!--\t"use strict";-->
//
// <!--\tfunction race(v1, v2, g) {-->
// <!--\t\tlet time = g/(v2 - v1);-->
// <!--\t\tif(time < 0) return null;-->
// <!--\t\tlet hour = Math.trunc(time % 60);-->
// <!--\t\tlet minutes = Math.trunc(time * 60 % 60);-->
// <!--\t\tlet seconds = Math.trunc(time * 3600 % 60);-->
// <!--\t\treturn [hour, minutes, seconds];-->
// <!--\t}-->
//
// <!--\talert(race(80, 91, 37));// [3, 21, 49]-->
// <!--</script>-->
// <!--</body>-->
// <!--</html>-->`;


function useTasksArr() {
    let cache: ParsedTask[] | null = null;
    const [tasks, setTasks] = useState<ParsedTask[]>(cache ?? []); // ← не null

    useEffect(() => {
        if (cache) return setTasks(cache);

        fetch('/tasks.txt').then(r => r.text()).then(text => {
            const parsed = parseTasksArr(text);
            cache = parsed;
            setTasks(parsed); // всегда ParsedTask[]
        });

    }, []);

    return tasks;
}


export default function Page() {

    console.log(useTasksArr())
    return (
        <div>
            {/*{JSON.stringify(parseTasksArr(tasksW))};*/}
        </div>
    );
}