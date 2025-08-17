import type {Metadata} from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "CatTasks - Task Management App",
    description: "A Next.js task management application with interactive features",
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
        <body className="antialiased">
        {children}
        </body>
        </html>
    );
}
