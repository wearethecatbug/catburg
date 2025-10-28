'use client';

import React from 'react';
import {useTheme} from './themeProvider';

export default function ThemeToggle() {
    const {mode, resolved, setMode, toggle, cycle} = useTheme();

    return (
        <div style={{display: 'inline-flex', gap: 8, alignItems: 'center'}}>
      <span style={{opacity: 0.8, fontSize: 12}}>
        mode: <b>{mode}</b> • resolved: <b>{resolved}</b>
      </span>

            <button onClick={toggle} aria-label="Toggle light/dark">Toggle</button>
            <button onClick={cycle} aria-label="Cycle themes">Cycle</button>

            <select
                aria-label="Set theme"
                value={mode}
                onChange={e => setMode(e.target.value as any)}
                style={{padding: '4px 8px'}}
            >
                <option value="system">system</option>
                <option value="light">light</option>
                <option value="dark">dark</option>
                <option value="blue">blue</option>
            </select>
        </div>
    );
}