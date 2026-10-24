(function (root) {
  'use strict';

  // Herkese açık hesap API'si (OtoCore). Kod konularına göre core-*.js dosyalarına bölünmüştür;
  // tarayıcıda o dosyalar bu dosyadan önce yüklenir, Node'da (testler, araçlar) burada require edilir.
  const load = (name, file) => root[name] || require(file);
  const parts = Object.assign(
    {},
    load('OtoCoreRecords', './core-records.js'),
    load('OtoCoreCsv', './core-csv.js'),
    load('OtoCorePrice', './core-price.js'),
    load('OtoCoreLimits', './core-limits.js'),
    load('OtoCoreDeal', './core-deal.js')
  );
  const api = {
    dealScore: parts.dealScore,
    compareDeals: parts.compareDeals,
    sellerType: parts.sellerType,
    localDate: parts.localDate,
    prunePages: parts.prunePages,
    BODY_PARTS: parts.BODY_PARTS,
    bodyDamage: parts.bodyDamage,
    bodyReport: parts.bodyReport,
    bodyConflict: parts.bodyConflict,
    sameDamage: parts.sameDamage,
    dealEligible: parts.dealEligible,
    dataCoverage: parts.dataCoverage,
    MAX_ROWS: parts.MAX_ROWS,
    fuelSet: parts.fuelSet,
    listingUrl: parts.listingUrl,
    watchedAmong: parts.watchedAmong,
    LIMITS: parts.LIMITS,
    contactGate: parts.contactGate,
    recordEvent: parts.recordEvent,
    phoneSaveGate: parts.phoneSaveGate,
    browsePace: parts.browsePace,
    normalizeLog: parts.normalizeLog,
    advise: parts.advise,
    suddenDrop: parts.suddenDrop,
    normalizePages: parts.normalizePages,
    recordPage: parts.recordPage,
    removeListings: parts.removeListings,
    removePage: parts.removePage,
    safeSahibindenUrl: parts.safeSahibindenUrl,
    DEFAULTS: parts.DEFAULTS,
    key: parts.key,
    brandKey: parts.brandKey,
    number: parts.number,
    date: parts.date,
    safeListingUrl: parts.safeListingUrl,
    parseCsv: parts.parseCsv,
    importCsv: parts.importCsv,
    normalizeRecord: parts.normalizeRecord,
    merge: parts.merge,
    mergeObservations: parts.mergeObservations,
    priceChange: parts.priceChange,
    median: parts.median,
    daysSince: parts.daysSince,
    estimate: parts.estimate,
    summary: parts.summary,
    modelPace: parts.modelPace,
    paceLines: parts.paceLines
  };
  root.OtoCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
