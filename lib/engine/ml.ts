import modelJson from "./model.json"
import { extractMlFeatures, featureNames } from "./ml-features"
import type { MlResult } from "./types"

export interface ExportedModel {
  name: string
  version: string
  features: string[]
  mean: number[]
  scale: number[]
  coef: number[]
  intercept: number
  threshold: number
  calibrated: boolean
  metrics: {
    precision: number
    recall: number
    f1: number
    accuracy: number
    roc_auc: number
    brier: number
    confusion_matrix: { tn: number; fp: number; fn: number; tp: number }
    support: { phishing: number; legitimate: number }
  }
  dataset: {
    name: string
    license: string
    source: string
    retrieved: string
    unique_hostnames: number
    class_counts: { phishing: number; legitimate: number }
  }
  trained_at: string
}

export const MODEL = modelJson as ExportedModel

/** The exported model is only usable if its feature list matches this build's extractor. */
export function modelIsUsable(model: ExportedModel = MODEL): boolean {
  const names = featureNames()
  return (
    model.features.length === names.length &&
    model.features.every((n, i) => n === names[i]) &&
    [model.mean, model.scale, model.coef].every((a) => a.length === names.length)
  )
}

export function predictProbability(host: string, model: ExportedModel = MODEL) {
  const x = extractMlFeatures(host)
  const contributions = x.map((v, i) => ((v - model.mean[i]) / model.scale[i]) * model.coef[i])
  const z = model.intercept + contributions.reduce((a, b) => a + b, 0)
  return { probability: 1 / (1 + Math.exp(-z)), contributions }
}

/** Runs the hostname classifier. Unusable model → "unavailable", never a substitute value. */
export function classify(hostname: string): MlResult {
  if (!modelIsUsable()) {
    return {
      status: "unavailable",
      probability: null,
      modelName: null,
      detail: "The trained model does not match this build's feature extractor.",
      topFactors: [],
    }
  }
  const host = hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, "")
  const { probability, contributions } = predictProbability(host)
  const names = featureNames()
  const topFactors = contributions
    .map((impact, i) => ({ feature: names[i], impact }))
    .filter((f) => Math.abs(f.impact) > 0.05)
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
    .slice(0, 5)
    .map((f) => ({ feature: f.feature, impact: Math.round(f.impact * 100) / 100 }))
  return {
    status: "available",
    probability,
    modelName: `${MODEL.name} (${MODEL.version})`,
    detail:
      "Statistical estimate from the hostname alone. Uncalibrated: treat it as a relative signal, not a true probability. It is not part of the risk score.",
    topFactors,
  }
}
