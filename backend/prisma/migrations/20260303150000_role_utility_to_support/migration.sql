-- Replace role UTILITY by SUPPORT in participants
UPDATE participants SET role = 'SUPPORT' WHERE role = 'UTILITY';
