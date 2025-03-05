import {Audiowide} from 'next/font/google'
import {Example} from "@/app/example/Example";

const audiowide = Audiowide({
    weight: '400',
    subsets: ['latin'],
})

export default function Home() {
    return (
            <Example />
    );
}