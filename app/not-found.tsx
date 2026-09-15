import Link from "next/link";
export default function NotFound() { return <main className="not-found"><p className="eyebrow">ERROR / 404</p><h1>Signal lost.</h1><p>This route isn’t part of the system.</p><Link className="button primary" href="/">Return to mission control</Link></main>; }
