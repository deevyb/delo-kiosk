import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="font-yatra text-6xl text-delo-maroon mb-4">
        Delo Coffee
      </h1>
      <p className="font-roboto-mono text-delo-navy/70 mb-12">
        Where Every Cup Brings People Together
      </p>

      <div className="flex gap-6">
        <Link
          href="/order"
          className="px-8 py-4 bg-delo-maroon text-delo-cream font-bricolage font-semibold text-xl rounded-xl hover:bg-delo-maroon/90 transition-colors"
        >
          Start Ordering
        </Link>
        <Link
          href="/kitchen"
          className="px-8 py-4 border-2 border-delo-maroon text-delo-maroon font-bricolage font-semibold text-xl rounded-xl hover:bg-delo-maroon/10 transition-colors"
        >
          Kitchen Display
        </Link>
        <Link
          href="/admin"
          className="px-8 py-4 border-2 border-delo-navy/30 text-delo-navy/70 font-bricolage font-semibold text-xl rounded-xl hover:bg-delo-navy/10 transition-colors"
        >
          Admin
        </Link>
      </div>
    </main>
  )
}
