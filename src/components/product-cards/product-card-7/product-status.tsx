import { StatusWrapper } from "./styles";

// ==============================================================
type Props = { status: string };
// ==============================================================

export default function ProductStatus({ status }: Props) {
  return status ? (
    <StatusWrapper>
      <span className="chip">{status}</span>

      <div className="triangle">
        <div className="triangle-left" />
        <div className="triangle-right" />
      </div>
    </StatusWrapper>
  ) : null;
}
