-- Grant service_role access to notification-related tables
GRANT SELECT ON user_profiles TO service_role;
GRANT SELECT ON jadwal_absensi TO service_role;
GRANT SELECT ON perizinan TO service_role;
GRANT SELECT ON absences TO service_role;
