/**
 * Validation scoring and peak finding for choosing best k.
 * Port of phytclust algo/scoring.py (Calinski–Harabasz–style score + elbow, then find peaks).
 */

(function (global) {
  'use strict';

  const INF = Number.POSITIVE_INFINITY;

  /**
   * Single-cluster validation score for a given k.
   * Returns { beta, beta_ratios, score }.
   */
  function singleClusterScore(pc, k) {
    if (!pc.max_k || pc.max_k <= 0) return { beta: INF, beta_ratios: INF, score: INF };
    const root = pc.postorderNodes[pc.postorderNodes.length - 1];
    const rootId = pc.nodeToId.get(root);
    const dpRow = pc.dp_table[rootId];
    if (dpRow == null) return { beta: INF, beta_ratios: INF, score: INF };
    if (k < 1 || k > pc.max_k || k - 1 >= dpRow.length) return { beta: INF, beta_ratios: INF, score: INF };

    const beta1 = dpRow[0];
    const beta = dpRow[k - 1];
    const numTerminals = pc.numTerminals;

    if (!isFinite(beta) || beta < 0) return { beta: beta, beta_ratios: INF, score: 0 };
    if (beta === 0) return { beta: 0, beta_ratios: INF, score: 0 };

    const betaRatios = (beta1 - beta) / beta;
    const normRatios = (numTerminals - k) / k;
    const score = isFinite(betaRatios) && isFinite(normRatios) ? betaRatios * normRatios : INF;
    return { beta: beta, beta_ratios: betaRatios, score: score };
  }

  /**
   * Compute validation scores for k = 1 .. max_k, then combine with elbow term.
   * Sets pc.scores (combined), pc.beta_values. Returns { combinedScores, betaValues }.
   * combinedScores[i] corresponds to k = i + 1.
   */
  function calculateScores(pc) {
    if (!pc.max_k || pc.max_k <= 0) {
      pc.scores = [];
      pc.beta_values = [];
      return { combinedScores: [], betaValues: [] };
    }

    const betaValues = [];
    const denList = [];
    const scores = [];

    for (let kVal = 1; kVal <= pc.max_k; kVal++) {
      const r = singleClusterScore(pc, kVal);
      betaValues.push(r.beta);
      denList.push((pc.numTerminals - kVal) / kVal);
      scores.push(r.score < 0 ? 0 : (isFinite(r.score) ? r.score : INF));
    }

    const n = betaValues.length;
    for (let i = 0; i < n; i++) {
      if (betaValues[i] < 0 || !isFinite(betaValues[i])) betaValues[i] = 0;
    }

    const elbowScores = [];
    const ELBOW_CAP = 1e4;
    for (let i = 0; i < n - 1; i++) {
      const denom = betaValues[i] - betaValues[i + 1];
      if (i > 0 && denom !== 0 && isFinite(denom)) {
        const raw = (betaValues[i - 1] - betaValues[i]) / denom;
        const capped = isFinite(raw) ? Math.min(Math.max(0, raw), ELBOW_CAP) : 0;
        elbowScores.push(capped);
      } else {
        elbowScores.push(0);
      }
    }
    elbowScores.push(0);

    const combinedScores = [];
    const eps = 1e-12;
    let lastUseful = 0;
    for (let i = 0; i < n; i++) {
      const s = scores[i];
      const e = elbowScores[i];
      const valid = isFinite(s) && isFinite(e) && !isNaN(s) && !isNaN(e);
      const v = valid ? s * e : 0;
      const num = isFinite(v) && !isNaN(v) ? v : 0;
      combinedScores.push(num);
      if (Math.abs(num) > eps) lastUseful = i + 1;
    }

    const combinedTrimmed = combinedScores.slice(0, lastUseful || combinedScores.length);
    const betaTrimmed = betaValues.slice(0, combinedTrimmed.length);

    pc.scores = combinedTrimmed;
    pc.beta_values = betaTrimmed;
    return { combinedScores: combinedTrimmed, betaValues: betaTrimmed };
  }

  /**
   * Find local peaks in the score curve (log-transformed), with prominence.
   * scores[i] is for k = i + 1.
   * Returns array of { k, prominence, origScore } sorted by adjusted rank (best first).
   */
  function findPeaks(scores, opts) {
    opts = opts || {};
    const minProminence = opts.min_prominence != null ? opts.min_prominence : 1e-3;
    const minK = opts.min_k != null ? opts.min_k : 2;
    const lambdaWeight = opts.lambda_weight != null ? opts.lambda_weight : 0.7;

    if (scores == null || scores.length < 2) return [];

    const logScores = scores.map(function (s) {
      const x = typeof s === 'number' && isFinite(s) ? s : 0;
      return Math.log(x + 1e-10);
    });

    const peakData = [];
    for (let i = 1; i < logScores.length - 1; i++) {
      const left = logScores[i - 1];
      const right = logScores[i + 1];
      const center = logScores[i];
      if (center < left || center < right) continue;
      const prominence = Math.min(center - left, center - right);
      if (prominence < minProminence) continue;
      const k = i + 1;
      if (k < minK) continue;
      if (k === 2) continue;
      const origScore = scores[i];
      peakData.push({ k: k, prominence: prominence, origScore: origScore });
    }

    if (peakData.length === 0) return [];

    const allProm = peakData.map(function (p) { return p.prominence; });
    const allSc = peakData.map(function (p) { return p.origScore; });
    const promMin = Math.min.apply(null, allProm);
    const promMax = Math.max.apply(null, allProm);
    const scoreMin = Math.min.apply(null, allSc);
    const scoreMax = Math.max.apply(null, allSc);
    const promRange = promMax - promMin || 1;
    const scoreRange = scoreMax - scoreMin || 1;

    peakData.forEach(function (p) {
      const promNorm = (p.prominence - promMin) / promRange;
      const scoreNorm = (p.origScore - scoreMin) / scoreRange;
      p.combined = lambdaWeight * promNorm + (1 - lambdaWeight) * scoreNorm;
    });
    peakData.sort(function (a, b) { return b.combined - a.combined; });
    return peakData;
  }

  /**
   * Get the best k from the score curve: top-ranked peak, or fallback 2 if no peaks.
   */
  function findBestK(pc, opts) {
    opts = opts || {};
    const maxK = pc.max_k != null ? pc.max_k : pc.numTerminals;
    if (maxK < 2) return 2;
    calculateScores(pc);
    const scores = pc.scores;
    if (scores == null || scores.length < 2) return 2;
    const peaks = findPeaks(scores, opts);
    if (peaks.length === 0) return 2;
    return peaks[0].k;
  }

  global.PhytClustScoring = {
    singleClusterScore: singleClusterScore,
    calculateScores: calculateScores,
    findPeaks: findPeaks,
    findBestK: findBestK
  };
})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : this);
