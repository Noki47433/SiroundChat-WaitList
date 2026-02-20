export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="px-6 pb-10 pt-6 sm:px-8 sm:pb-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-4 rounded-[1.7rem] border border-amber-300/40 bg-white/80 px-5 py-6 text-sm text-slate-700 shadow-[0_18px_38px_-30px_rgba(245,158,11,0.75)] backdrop-blur-xl sm:flex-row sm:items-center sm:px-7">
        <p>&copy; {currentYear} SiroundChat</p>
        <nav className="flex items-center gap-5">
          <a className="transition hover:text-amber-600" href="#">
            Privacy
          </a>
          <a className="transition hover:text-amber-600" href="#">
            Terms
          </a>
          <a className="transition hover:text-amber-600" href="#">
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}
