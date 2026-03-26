export type DeliveryPreference = 'morning' | 'evening' | 'both'
export type SkiStyle = 'piste' | 'offpiste' | 'touring'

export interface Subscriber {
  id: string
  email: string
  region_area: string
  region_code: string | null
  styles: SkiStyle[]
  delivery: DeliveryPreference
  confirmed: boolean
  unsubscribe_token: string
  created_at: string
}

export interface BulletinAnalysis {
  date: string
  overallVerdict: string
  verdictColour: 'green' | 'amber' | 'red'
  dangerLevel: string
  summary: string
  onPiste: { rating: string; notes: string }
  offPiste:  { rating: string; notes: string }
  skiTouring: { rating: string; notes: string }
  keyHazards: string[]
  bestBets: string[]
  outlook: string
  weather: {
    summitTemp: string
    midTemp: string
    resortTemp: string
    freezingLevel: string
    wind: string
    visibility: string
    newSnow24h: string
    baseDepth: string
  }
}

// Map of area slug → array of [regionCode, regionName]
export const REGION_MAP: Record<string, [string, string][]> = {
  verbier:     [['4115', 'Martigny–Verbier'], ['4116', 'Haut Val de Bagnes']],
  zermatt:     [['4222', 'Zermatt'], ['4223', 'Saas Fee'], ['4224', 'Monte Rosa']],
  crans:       [['4121', 'Montana'], ['4124', "Val d'Anniviers"]],
  saas:        [['4231', 'N. Simplon'], ['4232', 'S. Simplon']],
  obergoms:    [['4241', 'Reckingen'], ['4243', 'N. Obergoms'], ['4244', 'S. Obergoms']],
  grindelwald: [['1242', 'Grindelwald'], ['1234', 'Jungfrau–Schilthorn'], ['1233', 'Lauterbrunnen']],
  adelboden:   [['1226', 'Adelboden'], ['1224', 'Lenk'], ['1227', 'Engstligen']],
  gstaad:      [['1222', 'Gstaad'], ['1223', 'Wildhorn']],
  kandersteg:  [['1231', 'Kandersteg'], ['1232', 'Blüemlisalp']],
  davos:       [['5123', 'Davos'], ['5122', 'Schanfigg'], ['5111', 'N. Prättigau']],
  stmoritz:    [['7114', 'St Moritz'], ['7111', 'Corvatsch'], ['7112', 'Bernina']],
  laax:        [['5124', 'Flims'], ['5214', 'Obersaxen–Safien']],
  arosa:       [['5221', 'Domleschg–Lenzerheide'], ['5231', 'Albulatal']],
  andermatt:   [['2223', 'N. Urseren'], ['2224', 'S. Urseren'], ['2221', 'Meiental']],
  engelberg:   [['2122', 'Engelberg'], ['2121', 'Glaubenberg']],
  lugano:      [['6131', 'Lugano area'], ['6132', 'Mendrisio']],
  leventina:   [['6112', 'Upper Leventina'], ['6113', 'Val Blenio']],
}
