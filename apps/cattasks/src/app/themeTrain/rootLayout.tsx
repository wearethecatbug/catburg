import './theme.css';
import Link from 'next/link';
import {ThemeProvider} from './themeProvider';
import ThemeToggle from './ThemeToggle';

export default function RootLayout({children}: { children: React.ReactNode }) {
    return (
        <html lang="en">
        <head>
            <script
                dangerouslySetInnerHTML={{
                    __html: `(function(){try{var k='theme:v1',m=localStorage.getItem(k)||'system';
var sys=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
document.documentElement.setAttribute('data-theme',m==='system'?sys:m);}catch(e){}})();`,
                }}
            />
        </head>
        <body>
        <ThemeProvider>
            <header style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderBottom: '1px solid',
                borderColor: 'color-mix(in srgb, var(--fg) 15%, transparent)'
            }}>
                <div style={{display: 'flex', gap: 8, alignItems: 'baseline'}}>
                    <span style={{fontWeight: 700}}>ThemeTrain</span>
                    <nav style={{display: 'flex', gap: 12, fontSize: 14, opacity: .9}}>
                        <Link href="/">Home</Link>
                        <a href="https://nextjs.org">Docs</a>
                    </nav>
                </div>
                <ThemeToggle/>
            </header>
            {children}
        </ThemeProvider>
        </body>
        </html>
    );
}
