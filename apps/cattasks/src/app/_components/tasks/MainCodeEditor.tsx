'use client';
import {useState} from 'react';
import styles from './MainCodeEditor.module.css';

type Props = React.HTMLAttributes<HTMLDivElement>;

export default function MainCodeEditor({className, ...rest}: Props) {
    const [code, setCode] = useState('// write code here');

    function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === 'Tab') {
            e.preventDefault();
            const el = e.currentTarget;
            const {selectionStart, selectionEnd, value} = el;
            const insert = '  '; // таб = 2 пробела
            const next = value.slice(0, selectionStart) + insert + value.slice(selectionEnd);
            setCode(next);
            // восстановить каретку
            queueMicrotask(() => el.setSelectionRange(selectionStart + insert.length, selectionStart + insert.length));
        }
    }

    return (
        <div className={styles.codeEditorContainer}>
      <textarea
          className={styles.editor}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          placeholder="// write code here"
      />
        </div>
    );
}