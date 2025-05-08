import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const HORIZON_ASSET_URL = 'https://horizon.stellar.org/assets?limit=100';

const syncStellarAssets = async (req, res) => {
  try {
    const response = await fetch(HORIZON_ASSET_URL);
    const data = await response.json();

    const assets = data._embedded.records;

    const syncResults = [];

    for (const asset of assets) {
      const { asset_code, asset_issuer } = asset;

      // skip invalid assets
      if (!asset_code || !asset_issuer) continue;

      try {
        const currency = await prisma.currency.upsert({
          where: { code: asset_code },
          update: {
            stellarAsset: asset_issuer,
            isCrypto: true,
          },
          create: {
            code: asset_code,
            name: asset_code,
            isCrypto: true,
            stellarAsset: asset_issuer,
            minBalance: 1, // adjust if needed
          },
        });

        syncResults.push({ code: currency.code, status: 'synced' });
      } catch (err) {
        syncResults.push({ code: asset_code, status: 'error', error: err.message });
      }
    }

    return res.status(200).json({
      message: 'Stellar assets synced successfully.',
      results: syncResults,
    });
  } catch (err) {
    console.error('Sync failed:', err);
    return res.status(500).json({ error: 'Failed to sync Stellar assets' });
  }
};

export default syncStellarAssets;
