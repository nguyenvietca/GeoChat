# Requires the two verify-042 images. Uses synthetic data only.
$ErrorActionPreference = 'Stop'
$project = 'geochat-v042-' + [Guid]::NewGuid().ToString('N').Substring(0, 10)
$composeFile = Join-Path $PSScriptRoot 'compose.verify.yml'
function Dc {
    $result = & docker compose -p $project -f $composeFile @args
    if ($LASTEXITCODE -ne 0) { throw "Disposable Compose failed: $($args[0])" }
    return $result
}
function Sql([string]$statement, [string]$database = 'verify042') {
    Dc exec -T postgres psql -U verify042 -d $database -v ON_ERROR_STOP=1 -At -c $statement
}
function Api([string]$path, [string]$body = '', [string]$token = '') {
    $curlArgs = @('exec', '-T', 'backend', 'curl', '--silent', '--show-error', '--fail',
        '--max-time', '45', '-H', 'Content-Type: application/json')
    if ($token) { $curlArgs += @('-H', "Authorization: Bearer $token") }
    if ($body) { $curlArgs += @('--data-binary', '@-') }
    $curlArgs += "http://web:8080$path"
    $result = $body | & docker compose -p $project -f $composeFile @curlArgs
    if ($LASTEXITCODE -ne 0) { throw "Disposable API failed: $path" }
    $result | ConvertFrom-Json
}
try {
    Dc up -d --wait --wait-timeout 300 | Out-Host
    Api '/api/health' | Out-Null
    Api '/api/v1/auth/register' '{"username":"release042","password":"Release042-test!","displayName":"Synthetic release test"}' | Out-Null
    $login = Api '/api/v1/auth/login' '{"username":"release042","password":"Release042-test!"}'
    $token = $login.data.token
    if (-not $token) { throw 'Login returned no token' }
    Api '/api/v1/chats' '' $token | Out-Null
    Sql "INSERT INTO users(username,password_hash,display_name) VALUES ('other042','synthetic-hash','Synthetic other'); INSERT INTO conversations(type,conversation_key) VALUES ('DIRECT','release042'); INSERT INTO messages(conversation_id,sender_id,content) SELECT c.id,u.id,'synthetic recovery message' FROM conversations c,users u WHERE c.conversation_key='release042' AND u.username='release042'; INSERT INTO user_locations(user_id,latitude,longitude) SELECT id,0.01,0.01 FROM users WHERE username='release042';" | Out-Null
    $before = Sql "SELECT md5(string_agg(version || ':' || checksum, ',' ORDER BY installed_rank)) FROM flyway_schema_history WHERE success;"
    Dc stop postgres | Out-Host
    # Liveness intentionally stays 200; an authenticated DB operation must fail safely.
    Api '/api/health' | Out-Null
    $failure = Dc exec -T backend curl --silent --show-error --max-time 45 -w '\n%{http_code}' -H "Authorization: Bearer $token" http://web:8080/api/v1/chats
    $failureText = $failure -join "`n"
    Write-Output "Database outage response: $failureText"
    if ($failureText -notmatch '503$' -or $failureText -notmatch 'Service temporarily unavailable' -or $failureText -match 'jdbc:|SQLException|password_hash') { throw 'Unsafe/unexpected database outage response' }
    Dc start postgres | Out-Host
    $recovered = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try { Api '/api/v1/chats' '' $token | Out-Null; $recovered = $true; break }
        catch { Start-Sleep -Seconds 2 }
    }
    if (-not $recovered) { throw 'Database did not recover within retry window' }
    Dc restart web | Out-Host
    Dc up -d --wait --wait-timeout 60 | Out-Null
    Api '/api/v1/chats' '' $token | Out-Null
    $invalid = Dc exec -T backend curl --silent -o /dev/null -w '%{http_code}' -H 'Authorization: Bearer invalid' http://web:8080/api/v1/chats
    if ($invalid -ne '401') { throw 'Invalid JWT did not return 401' }
    $spa = Dc exec -T backend curl --fail --silent http://web:8080/messages
    if (($spa -join '') -notmatch 'id="root"') { throw 'SPA deep-link refresh failed' }
    Dc stop backend | Out-Null
    $unavailable = Dc run --rm --no-deps --entrypoint curl backend --silent --show-error --max-time 15 -o /dev/null -w '%{http_code}' http://web:8080/api/v1/chats
    if ($unavailable -ne '502') { throw 'Backend outage did not return proxy 502' }
    Dc start backend | Out-Null
    Dc up -d --wait --wait-timeout 120 | Out-Null
    Api '/api/v1/chats' '' $token | Out-Null
    Dc exec -T postgres pg_dump -U verify042 -d verify042 -Fc --file /tmp/recovery.dump | Out-Null
    Dc exec -T postgres createdb -U verify042 restored042 | Out-Null
    Dc exec -T postgres pg_restore -U verify042 -d restored042 --exit-on-error /tmp/recovery.dump | Out-Null
    $after = Sql "SELECT md5(string_agg(version || ':' || checksum, ',' ORDER BY installed_rank)) FROM flyway_schema_history WHERE success;" 'restored042'
    if ($before -ne $after) { throw 'Restored Flyway history mismatch' }
    $validation = Sql "SELECT (EXISTS(SELECT FROM pg_extension WHERE extname='postgis') AND EXISTS(SELECT FROM pg_indexes WHERE indexname='idx_user_locations_discovery_area' AND indexdef LIKE '%gist%') AND EXISTS(SELECT FROM messages m JOIN users u ON u.id=m.sender_id JOIN conversations c ON c.id=m.conversation_id WHERE m.content='synthetic recovery message' AND u.username='release042') AND EXISTS(SELECT FROM user_locations WHERE discovery_area IS NOT NULL))::text;" 'restored042'
    if ($validation -ne 'true') { throw 'Restored schema/data validation failed' }
    # Check the restored DB through the application (Flyway + Hibernate validation + login).
    Dc stop backend | Out-Null
    Dc run --rm --no-deps -d --name "$project-restored" -e DB_NAME=restored042 backend | Out-Null
    try {
        $ready = $false
        for ($attempt = 0; $attempt -lt 60; $attempt++) {
            & docker exec "$project-restored" curl --fail --silent http://127.0.0.1:8080/api/health 2>$null | Out-Null
            if ($LASTEXITCODE -eq 0) { $ready = $true; break }
            Start-Sleep -Seconds 2
        }
        if (-not $ready) { throw 'Application failed to start against restored DB' }
        $restoredLogin = '{"username":"release042","password":"Release042-test!"}' | & docker exec -i "$project-restored" curl --fail --silent -H 'Content-Type: application/json' --data-binary '@-' http://127.0.0.1:8080/api/v1/auth/login
        if ($LASTEXITCODE -ne 0 -or -not ($restoredLogin | ConvertFrom-Json).data.token) { throw 'Restored application login failed' }
    } finally { & docker rm -f "$project-restored" | Out-Null }
    Write-Output 'PASS: proxy, SPA refresh, authentication, database outage/recovery, Backend outage/502/recovery with same JWT, Web restart, invalid JWT, synthetic dump/restore, PostGIS/index/Flyway/data, restored application login.'
} catch {
    Dc logs --tail 100 backend postgres | Out-Host
    throw
} finally {
    # Explicit unique project and file; no persistent volumes or live stack involved.
    Dc down | Out-Host
}
