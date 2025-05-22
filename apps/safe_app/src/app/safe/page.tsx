import {Audiowide} from 'next/font/google'
import {Example} from "@/app/example/Example";
import SafeContainer from "@/components/safe/SafeContainer";

const audiowide = Audiowide({
    weight: '400',
    subsets: ['latin'],
})

export default function Home() {
    return (
            <SafeContainer />
    );
}