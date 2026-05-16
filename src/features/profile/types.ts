/** Shape returned to `useActionState` in the profile form. */
export interface ProfileFormState {
  error: string | null;
}

export const initialProfileState: ProfileFormState = { error: null };
