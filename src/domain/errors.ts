/** Base class for domain-rule violations thrown by domain operations. */
export class DomainError extends Error {}

export class ExerciseNotFoundError extends DomainError {
  constructor(exerciseId: string) {
    super(`Exercise "${exerciseId}" was not found`);
    this.name = 'ExerciseNotFoundError';
  }
}

export class BuiltInExerciseImmutableError extends DomainError {
  constructor(exerciseId: string) {
    super(`Built-in exercise "${exerciseId}" cannot be modified`);
    this.name = 'BuiltInExerciseImmutableError';
  }
}

export class ExerciseNotSelectableError extends DomainError {
  constructor(exerciseId: string) {
    super(`Exercise "${exerciseId}" is not available for selection`);
    this.name = 'ExerciseNotSelectableError';
  }
}

export class ExerciseLimitError extends DomainError {
  constructor(limit: number) {
    super(`At most ${limit} active custom exercises are allowed`);
    this.name = 'ExerciseLimitError';
  }
}

export class RoutineNotFoundError extends DomainError {
  constructor(routineId: string) {
    super(`Routine "${routineId}" was not found`);
    this.name = 'RoutineNotFoundError';
  }
}

export class RoutineLimitError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'RoutineLimitError';
  }
}

export class WorkoutNotFoundError extends DomainError {
  constructor(workoutId: string) {
    super(`Workout "${workoutId}" was not found`);
    this.name = 'WorkoutNotFoundError';
  }
}

export class WorkoutNotActiveError extends DomainError {
  constructor(workoutId: string) {
    super(`Workout "${workoutId}" is not active`);
    this.name = 'WorkoutNotActiveError';
  }
}

export class ActiveWorkoutExistsError extends DomainError {
  constructor() {
    super('An active workout already exists');
    this.name = 'ActiveWorkoutExistsError';
  }
}

export class ExerciseAlreadyInWorkoutError extends DomainError {
  constructor(exerciseId: string) {
    super(`Exercise "${exerciseId}" is already in this workout`);
    this.name = 'ExerciseAlreadyInWorkoutError';
  }
}
