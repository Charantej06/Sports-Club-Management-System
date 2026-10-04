export function CheckoutArt({ side }: { side: "left" | "right" }) {
  return (
    <div className={`checkout-art checkout-art-${side}`} aria-hidden="true">
      <svg viewBox="0 0 240 900" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M-80 150 240 470M-80 190 240 510M-80 230 240 550"
          stroke="#ff6b2c"
          strokeWidth="2"
        />
        <g transform="rotate(-28 120 210)" stroke="#f5f5f5" strokeWidth="3">
          <ellipse cx="120" cy="170" rx="62" ry="86" />
          <ellipse cx="120" cy="170" rx="53" ry="76" />
          <path d="M100 240 108 286H132L140 240M108 286V382H132V286" />
          <path
            d="M80 110V230M100 96V245M120 94V248M140 96V245M160 110V230M68 130H170M66 150H176M66 170H176M66 190H176M72 210H170"
            strokeWidth="1"
          />
          <path
            d="M108 300H132M108 312H132M108 324H132M108 336H132M108 348H132M108 360H132"
            stroke="#ff6b2c"
            strokeWidth="5"
          />
        </g>
        <circle cx="145" cy="585" r="54" stroke="#ff6b2c" strokeWidth="3" />
        <path
          d="M100 555Q165 565 176 624M128 534Q106 590 155 637"
          stroke="#ff6b2c"
          strokeWidth="3"
        />
        <path
          d="M-20 760H230V880H-20M55 760V880M155 760V880M-20 820H230"
          stroke="#666"
          strokeWidth="1"
        />
        <path
          d="m45 685 35-18 20 39-35 18zM57 694l20-10M63 705l20-10"
          stroke="#fff"
          strokeWidth="2"
        />
        <path
          d="M186 45h32M202 29v32M22 475h32M38 459v32"
          stroke="#ff6b2c"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}
