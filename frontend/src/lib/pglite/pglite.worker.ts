import { worker } from "@electric-sql/pglite/worker";
import { PGlite } from "@electric-sql/pglite";
import { live } from "@electric-sql/pglite/live";
import { PGLITE_SCHEMA_SQL } from "./pglite-schema";

void worker({
  async init() {
    const pg = new PGlite("idb://merter_catalog_b2b", {
      extensions: { live },
    });
    // Ensure table structure and indexes are initialized on first boot
    await pg.exec(PGLITE_SCHEMA_SQL);
    return pg;
  },
});

