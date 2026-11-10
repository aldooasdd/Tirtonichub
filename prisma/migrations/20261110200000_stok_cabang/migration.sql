-- Stok per cabang di /pos: stok per gudang dari sync + peta gudang → cabang.
ALTER TABLE "MarketplaceItem" ADD COLUMN "whStock" JSONB;
ALTER TABLE "Branch" ADD COLUMN "warehouseIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
