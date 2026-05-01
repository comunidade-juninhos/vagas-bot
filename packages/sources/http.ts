export const FIREFOX_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0";

type BrowserHeadersOptions = {
  accept?: string;
  origin?: string;
  referer?: string;
};

export const browserHeaders = ({
  accept = "application/json, text/plain, */*",
  origin,
  referer,
}: BrowserHeadersOptions = {}): Record<string, string> => ({
  accept,
  "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "cache-control": "no-cache",
  dnt: "1",
  pragma: "no-cache",
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": origin ? "cross-site" : "same-origin",
  "user-agent": FIREFOX_USER_AGENT,
  ...(origin ? { origin } : {}),
  ...(referer ? { referer } : {}),
});
