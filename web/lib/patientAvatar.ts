// Deterministic demo portraits for the patient list.
// Mix of women and men so the roster feels real without uploading photos.

const WOMEN = [12, 21, 32, 44, 47, 65, 68, 90];
const MEN = [11, 22, 33, 41, 52, 61, 75, 86];

const KNOWN: Record<string, string> = {
  "Alex Morgan": portrait("women", 44),
  "Sam Rivera": portrait("men", 32),
  "Quentin Tarantino": portrait("men", 52),
  "Lucy Williams": "/images/Elena_pp.jpeg",
};

function portrait(gender: "women" | "men", n: number): string {
  return `https://randomuser.me/api/portraits/${gender}/${n}.jpg`;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Stable circle-friendly portrait URL for a patient name. */
export function patientAvatarUrl(name: string): string {
  const key = name.trim();
  if (KNOWN[key]) return KNOWN[key];

  const h = hash(key.toLowerCase());
  // Rough gender cue from common first names, else alternate by hash.
  const first = key.split(/\s+/)[0]?.toLowerCase() || "";
  const feminine =
    /^(alex|sam|jordan|taylor|casey|avery|riley|morgan|jamie|cameron)$/.test(first)
      ? h % 2 === 0
      : /^(ann|amy|sara|sarah|emma|olivia|mia|ava|sophia|isabella|elena|maria|lisa|kate|anna|julia|nora|maya|zoe)$/.test(
          first
        ) || (h % 2 === 0 && !/^(john|james|mike|mark|david|robert|william|thomas|quentin|matt|matthew|luke|noah)$/.test(first));

  if (feminine) return portrait("women", WOMEN[h % WOMEN.length]);
  return portrait("men", MEN[h % MEN.length]);
}

export function patientInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
