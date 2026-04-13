import PublicRateBoard from './_components/PublicRateBoard';

const API_URL = process.env.API_URL!;

async function getPublicRates() {
  try {
    const res = await fetch(`${API_URL}/api/v1/rates/public`, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function Home() {
  const rates = await getPublicRates();
  return <PublicRateBoard rates={rates} />;
}
