export function LogoMark(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" {...props}>
      <rect width="48" height="48" rx="16" fill="url(#promptlyGradient)" />
      <path d="M15 25c0-5.523 4.477-10 10-10h8" stroke="white" strokeWidth="4" strokeLinecap="round" />
      <path d="M33 23c0 5.523-4.477 10-10 10h-8" stroke="white" strokeOpacity=".6" strokeWidth="4" strokeLinecap="round" />
      <defs>
        <linearGradient id="promptlyGradient" x1="0" x2="48" y1="0" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00A3FF" />
          <stop offset="1" stopColor="#4be1ff" />
        </linearGradient>
      </defs>
    </svg>
  );
}
