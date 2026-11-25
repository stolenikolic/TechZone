import FlexBox from "components/flex-box/flex-box";
import PlayStore from "icons/PlayStore";
import AppleStore from "icons/AppleStore";
import { AppItem } from "./styles";

// ==============================================================
interface Props {
  playStoreUrl: string;
  appleStoreUrl: string;
}
// ==============================================================

export function FooterApps({ playStoreUrl, appleStoreUrl }: Props) {
  if (!playStoreUrl && !appleStoreUrl) return null;

  return (
    <FlexBox flexWrap="wrap" m={-1}>
      {playStoreUrl ? (
        <a href={playStoreUrl} target="_blank" rel="noreferrer noopener">
          <AppItem>
            <PlayStore />

            <div>
              <p className="subtitle">Preuzmi na</p>
              <p className="title">Google Play</p>
            </div>
          </AppItem>
        </a>
      ) : null}

      {appleStoreUrl ? (
        <a href={appleStoreUrl} target="_blank" rel="noreferrer noopener">
          <AppItem>
            <AppleStore />

            <div>
              <p className="subtitle">Preuzmi u</p>
              <p className="title">App Store</p>
            </div>
          </AppItem>
        </a>
      ) : null}
    </FlexBox>
  );
}
