import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Users,
    title: "One wallet, many members",
    body: "Pool money for the team offsite, the flat, or the side project.",
  },
  {
    icon: ShieldCheck,
    title: "Consensus approvals",
    body: "Member purchases wait for approval from the group before any money moves.",
  },
  {
    icon: Zap,
    title: "Live updates",
    body: "Requests and votes show up for every member the moment they happen.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-20">
      <section className="flex flex-col items-center gap-6 text-center">
        <Image src="/logo.svg" alt="ShareWallet logo" width={88} height={88} priority />
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          Shared money, <span className="text-primary">agreed spending</span>
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          ShareWallet gives groups a shared balance where admins spend directly and members spend
          once the group signs off.
        </p>
        <Button asChild size="lg">
          <Link href="/wallets">Open my wallets</Link>
        </Button>
      </section>
      <section className="mt-20 grid gap-6 sm:grid-cols-3">
        {features.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-xl bg-muted p-6">
            <Icon className="mb-3 size-6 text-primary" />
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
