import Link from "next/link";
import SvgIcon from "@mui/material/SvgIcon";
import IconButton from "@mui/material/IconButton";

export function HeaderLogin() {
  return (
    <Link href="/login">
      <IconButton>
        <SvgIcon fontSize="small">
          <svg viewBox="0 0 24 24">
            <g fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="9" r="3" />
              <circle cx="12" cy="12" r="10" />
              <path
                strokeLinecap="round"
                d="M17.97 20c-.16-2.892-1.045-5-5.97-5s-5.81 2.108-5.97 5"
              />
            </g>
          </svg>
        </SvgIcon>
      </IconButton>
    </Link>
  );
}
