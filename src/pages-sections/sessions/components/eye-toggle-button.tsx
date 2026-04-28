import IconButton from "@mui/material/IconButton";
// MUI ICON COMPONENTS
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import SvgIcon from "@mui/material/SvgIcon";

// ===============================================================
interface Props {
  show: boolean;
  click: () => void;
}
// ===============================================================

export default function EyeToggleButton({ show, click }: Props) {
  return (
    <IconButton size="small" onClick={click}>
      {show ? (
        <SvgIcon fontSize="small">
          <svg viewBox="0 0 32 32">
            <g fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2">
              <path d="M29 16c0 3-5.82 9-13 9S3 19 3 16s5.82-9 13-9s13 6 13 9Z" />
              <path d="M21 16a5 5 0 1 1-10 0a5 5 0 0 1 10 0Z" />
            </g>
          </svg>
        </SvgIcon>
      ) : (
        <SvgIcon fontSize="small">
          <svg viewBox="0 0 32 32">
            <path
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 16a5 5 0 0 1-5 5m-5-5a5 5 0 0 1 5-5m-3 13.654A13.4 13.4 0 0 0 16 25c7.18 0 13-6 13-9c0-1.336-1.155-3.268-3.071-5M19.5 7.47A13.5 13.5 0 0 0 16 7C8.82 7 3 13 3 16c0 1.32 1.127 3.22 3 4.935M7 25L25 7"
            />
          </svg>
        </SvgIcon>
      )}
    </IconButton>
  );
}
