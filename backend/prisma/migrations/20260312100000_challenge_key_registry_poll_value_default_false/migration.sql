-- challenge_keys_registry: default poll_value to false (list challenge keys once; always notify on new key).
ALTER TABLE challenge_keys_registry
  ALTER COLUMN poll_value SET DEFAULT false;
