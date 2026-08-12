/* =========================================================================
   PLACEHOLDER -- not a real generated file.
   Once you run:
     pac code add-data-source -a dataverse -t businessunit
   the PAC CLI will generate the real BusinessunitsService.ts (or similarly
   named) under src/generated/services/. Delete this placeholder file at
   that point -- if the CLI gives it a different name, update the import
   in src/services/dataverse.js to match instead of renaming the CLI's
   output.

   Until then, getAll() returns an empty result so the app falls back to
   its built-in mock Business Unit list (see fetchBusinessUnits in
   src/services/dataverse.js) instead of crashing.
   ========================================================================= */
export const BusinessunitsService = {
  async getAll(){
    return { data: { value: [] } };
  },
};