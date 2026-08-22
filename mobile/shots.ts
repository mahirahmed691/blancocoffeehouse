import { SUPABASE_ANON, SUPABASE_URL } from "./house";
import { HOUSE_SITE } from "./pieces";

export type ShotKind = "cup" | "sweets" | "house";
export type LookBoard = "pictures" | "today" | "wear";

export type Shot = {
  id: string;
  uri: string;
  alt: string;
  kinds: ShotKind[];
  added?: string;
};

const PRINTED: { file: string; alt: string; kinds: ShotKind[] }[] = [
  {
    file: "latte-case.jpg",
    alt: "An iced Blanco latte held in front of the pastry case and the house blanco. sign.",
    kinds: ["cup", "house"]
  },
  {
    file: "lights.jpg",
    alt: "An iced Blanco latte held in the dining room under the hanging lights.",
    kinds: ["cup", "house"]
  },
  {
    file: "sit-in.jpg",
    alt: "An iced Blanco latte on a marble table, looking out through the house toward Fiveways Parade.",
    kinds: ["cup", "house"]
  },
  {
    file: "mascot-counter.jpg",
    alt: "The Blanco mug mascot beside an iced latte, with cookies in the case below.",
    kinds: ["cup", "sweets"]
  },
  {
    file: "gelato-counter.jpg",
    alt: "An iced Blanco latte in front of the gelato cabinet.",
    kinds: ["cup", "house"]
  },
  {
    file: "latte-cookies.jpg",
    alt: "An iced Blanco latte on the counter, with cookie trays in the pastry case behind it.",
    kinds: ["cup", "sweets"]
  },
  {
    file: "cookie-case.jpg",
    alt: "Oreo cookies on a wooden tray in the pastry case, with Biscoff cookies below and Fiveways Parade in the window.",
    kinds: ["sweets", "house"]
  },
  {
    file: "oreo-cookie.jpg",
    alt: "Oreo cookies with a chocolate drip on a wooden tray.",
    kinds: ["sweets"]
  },
  {
    file: "pistachio-cookie.jpg",
    alt: "Pistachio and white chocolate cookies on a wooden tray.",
    kinds: ["sweets"]
  },
  {
    file: "biscoff-cookie.jpg",
    alt: "A Biscoff cookie on a wooden tray in the pastry case.",
    kinds: ["sweets"]
  },
  {
    file: "chocolate-cookie.jpg",
    alt: "Double chocolate cookies with white chocolate chunks on a wooden tray.",
    kinds: ["sweets"]
  },
  {
    file: "heart-cookie.jpg",
    alt: "Cookies topped with melted chocolate and a heart biscuit on a wooden tray.",
    kinds: ["sweets"]
  },
  {
    file: "caramel-cookie.jpg",
    alt: "Chocolate chip cookies with caramel and chocolate pieces on a wooden tray.",
    kinds: ["sweets"]
  },
  {
    file: "coffee-club-tee.jpg",
    alt: "A barista at the counter wearing the Blanco coffee club tee.",
    kinds: ["house"]
  },
  {
    file: "coffee-club.jpg",
    alt: "An iced Blanco latte held in front of the cool coffee club print.",
    kinds: ["cup", "house"]
  },
  {
    file: "soft-life.jpg",
    alt: "An iced Blanco latte held in front of the Soft Life Strong Coffee print.",
    kinds: ["cup", "house"]
  },
  {
    file: "matcha-lover.jpg",
    alt: "An iced Blanco latte held in front of the Matcha Lover print.",
    kinds: ["cup", "house"]
  },
  {
    file: "espresso-bar.jpg",
    alt: "An iced Blanco latte in front of the espresso machine.",
    kinds: ["cup"]
  },
  {
    file: "house-jars.jpg",
    alt: "Blanco-branded jars of tea, sugar, and matcha on the bar shelf.",
    kinds: ["house"]
  },
  {
    file: "matcha-jars.jpg",
    alt: "Stacked Blanco jars of sugar and matcha on the bar shelf.",
    kinds: ["house"]
  },
  {
    file: "cookie-gelato.jpg",
    alt: "A pistachio cookie in a paper bowl beside a scoop of gelato.",
    kinds: ["sweets"]
  },
  {
    file: "loaf.jpg",
    alt: "A chocolate chip loaf on a ceramic plate.",
    kinds: ["sweets"]
  },
  {
    file: "brownies.jpg",
    alt: "Oreo brownies and cookies from Blanco Coffee House.",
    kinds: ["sweets"]
  },
  {
    file: "table-ten.jpg",
    alt: "A toy car on table 10, with the blanco. sign and a stack of cups behind it.",
    kinds: ["house"]
  },
  {
    file: "storefront.jpg",
    alt: "The Blanco Coffee House shopfront at 4 Fiveways Parade, with iced drinks on the pavement.",
    kinds: ["house"]
  },
  {
    file: "interior.jpg",
    alt: "Inside Blanco Coffee House: a branded balloon above a tray of brownies.",
    kinds: ["house"]
  },
  {
    file: "matcha.jpg",
    alt: "An iced matcha and a chocolate chip cookie at Blanco Coffee House.",
    kinds: ["cup"]
  }
];

function addedLine(iso: string) {
  const day = new Date(iso);
  if (!isFinite(day.getTime())) return "";
  if (day.toDateString() === new Date().toDateString()) return "Added today";
  return (
    "Added " +
    day.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric"
    })
  );
}

function printedShots(): Shot[] {
  return PRINTED.map((shot) => ({
    id: "print:" + shot.file,
    uri: HOUSE_SITE + "/assets/photos/" + shot.file,
    alt: shot.alt,
    kinds: shot.kinds
  }));
}

function liveUri(path: string) {
  return SUPABASE_URL + "/storage/v1/object/public/gallery/" + path;
}

function asKind(value: string): ShotKind {
  if (value === "cup" || value === "sweets" || value === "house") return value;
  return "house";
}

export function filterShots(shots: Shot[], kind: "all" | ShotKind) {
  if (kind === "all") return shots;
  return shots.filter((shot) => shot.kinds.indexOf(kind) !== -1);
}

export async function fetchShots(): Promise<Shot[]> {
  const printed = printedShots();
  try {
    const res = await fetch(
      SUPABASE_URL + "/rest/v1/gallery_shots?select=*&order=sort.desc,created_at.desc",
      {
        headers: {
          apikey: SUPABASE_ANON,
          Authorization: "Bearer " + SUPABASE_ANON
        }
      }
    );
    if (!res.ok) return printed;
    const data = await res.json();
    const live: Shot[] = (Array.isArray(data) ? data : [])
      .map((row: { id?: string; path?: string; alt?: string; caption?: string; kind?: string; created_at?: string }) => {
        const path = String(row.path || "");
        if (!path) return null;
        return {
          id: "live:" + (row.id || path),
          uri: liveUri(path),
          alt: String(row.alt || row.caption || "From the house."),
          kinds: [asKind(String(row.kind || "house"))],
          added: addedLine(String(row.created_at || ""))
        };
      })
      .filter(Boolean) as Shot[];
    const seen: Record<string, boolean> = {};
    return [...live, ...printed].filter((shot) => {
      if (seen[shot.uri]) return false;
      seen[shot.uri] = true;
      return true;
    });
  } catch {
    return printed;
  }
}
