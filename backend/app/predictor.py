import pickle
from pathlib import Path
from datetime import datetime

import pandas as pd


_MODEL_FILE = Path(__file__).parent / "cycle_predictor.pkl"

# In-memory cache so we don't re-load every request.
_cached_model = None


class CyclePredictor:
    def __init__(
        self,
        predicted_length: float,
        trained_at: datetime,
        sample_size: int,
        mean_cycle: float,
        std_cycle: float,
    ):
        self.predicted_length = predicted_length
        self.trained_at = trained_at
        self.sample_size = sample_size
        self.mean_cycle = mean_cycle
        self.std_cycle = std_cycle

    def predict(self):
        return self.predicted_length

    def to_dict(self):
        return {
            "predicted_length": self.predicted_length,
            "trained_at": self.trained_at.isoformat(),
            "sample_size": self.sample_size,
            "mean_cycle": self.mean_cycle,
            "std_cycle": self.std_cycle,
        }

    @classmethod
    def from_dict(cls, data):
        return cls(
            predicted_length=data["predicted_length"],
            trained_at=datetime.fromisoformat(data["trained_at"]),
            sample_size=data["sample_size"],
            mean_cycle=data["mean_cycle"],
            std_cycle=data["std_cycle"],
        )


def _calculate_prediction(cycle_lengths: pd.Series) -> float:
    last_cycle = cycle_lengths.iloc[-1]
    avg_last3 = cycle_lengths.tail(3).mean()
    avg_last6 = cycle_lengths.tail(6).mean()

    trend_prediction = 0.5 * last_cycle + 0.3 * avg_last3 + 0.2 * avg_last6

    # Biological prior for cycle length
    prior = (30 + 35) / 2

    final_prediction = 0.7 * trend_prediction + 0.3 * prior
    return round(final_prediction, 1)


def _load_model() -> CyclePredictor | None:
    global _cached_model
    if _cached_model is not None:
        return _cached_model

    if not _MODEL_FILE.exists():
        return None

    try:
        with open(_MODEL_FILE, "rb") as f:
            data = pickle.load(f)
        model = CyclePredictor.from_dict(data)
        _cached_model = model
        return model
    except Exception:
        return None


def _save_model(model: CyclePredictor):
    global _cached_model
    with open(_MODEL_FILE, "wb") as f:
        pickle.dump(model.to_dict(), f)
    _cached_model = model


def train_model(cycle_lengths: list[float]) -> CyclePredictor | None:
    if len(cycle_lengths) < 3:
        return None

    series = pd.Series(cycle_lengths)
    predicted = _calculate_prediction(series)

    model = CyclePredictor(
        predicted_length=predicted,
        trained_at=datetime.utcnow(),
        sample_size=len(series),
        mean_cycle=float(series.mean()),
        std_cycle=float(series.std(ddof=0)),
    )
    _save_model(model)
    return model


def predict_cycle_length(cycle_lengths: list[float]) -> float | None:
    model = _load_model()
    if model and model.sample_size == len(cycle_lengths):
        return model.predict()

    model = train_model(cycle_lengths)
    return model.predict() if model else None


def invalidate_model():
    global _cached_model
    _cached_model = None
    try:
        _MODEL_FILE.unlink()
    except FileNotFoundError:
        pass
