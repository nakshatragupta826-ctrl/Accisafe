from services.accident_engine import AccidentDetectionEngine, SensorData


engine = AccidentDetectionEngine()


print("\n=== TEST 1: NORMAL RIDING ===")

normal = SensorData(
    acceleration=1.2,
    speed_before=50,
    speed_after=48,
    tilt_angle=5,
    observation_seconds=0,
    speed_during_observation=48,
)

print(engine.analyze(normal))


print("\n=== TEST 2: POTHOLE / FALSE POSITIVE ===")

pothole = SensorData(
    acceleration=5.5,
    speed_before=50,
    speed_after=42,
    tilt_angle=10,
    observation_seconds=0,
    speed_during_observation=42,
)

print(engine.analyze(pothole))


print("\n=== TEST 3: POSSIBLE ACCIDENT ===")

possible_accident = SensorData(
    acceleration=7.0,
    speed_before=60,
    speed_after=2,
    tilt_angle=65,
    observation_seconds=5,
    speed_during_observation=2,
)

print(engine.analyze(possible_accident))


print("\n=== TEST 4: CONFIRMED ACCIDENT ===")

confirmed_accident = SensorData(
    acceleration=8.0,
    speed_before=65,
    speed_after=0,
    tilt_angle=72,
    observation_seconds=15,
    speed_during_observation=0,
)

print(engine.analyze(confirmed_accident))