import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-xl px-4 py-20 text-center">
      <p className="badge mx-auto w-fit bg-brand-50 text-brand-700">404 · Page not found</p>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight text-ink-900">
        We can’t find that page
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-600">
        The link may be out of date, or the page may have moved.
      </p>
      <Link href="/" className="btn btn-primary mt-7">Return to VenueBook</Link>
    </section>
  );
}
