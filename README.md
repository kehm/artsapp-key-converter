# ArtsApp Key Converter

A tool for converting keys from the old ArtsApp format to the new JSON format and then insert them into the new database.

Run "npm start convert" to convert keys to the new format.  
Then run "npm start insert" to insert the keys to the new database.

Dependency <https://github.com/kehm/artsapp-database-model> must be imported to src/lib/database.  
Path to validation schema (<https://github.com/kehm/identification_key_schema>) must be specified in env. variable SCHEMA_PATH.

This project is created by the University of Bergen (UiB), Norway (Copyright).
