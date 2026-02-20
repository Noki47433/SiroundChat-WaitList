export function ChatIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path
        d="M6 18.5 3 21V6.5A3.5 3.5 0 0 1 6.5 3h11A3.5 3.5 0 0 1 21 6.5v7A3.5 3.5 0 0 1 17.5 17H9z"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8 9h8M8 13h5" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
