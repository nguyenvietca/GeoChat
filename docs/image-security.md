# Runtime image security verification

Both final runtime images were scanned with Trivy 0.69.3, including OS and Java
packages. Both reports contain **zero HIGH/CRITICAL** for the recorded DB snapshot.
This does not imply no lower-severity vulnerabilities or prove absence of exploitable
defects. [Triage](image-vulnerabilities-042.md) records every initial finding,
installed/fixed version, exposure and remediation: Web 49, Backend 17.

CycloneDX 1.6 SBOMs contain Backend 238 / Web 72 components. Reports, SBOMs,
checksums and image IDs are in ignored `artifacts/prompt042/`; no private database
data is included. Exact metadata/status: [verification report](release-verification-042.md).

## Reproduce in PowerShell

Run from root, sequentially after finishing disposable tests. Earlier parallel
scanning/testing exhausted host memory and locked the shared cache. Keep large
Trivy databases inside a Linux container layer, not a Windows bind mount. Ensure
adequate RAM/pagefile, Docker memory/swap and disk; limits cannot guarantee stability.

```powershell
New-Item -ItemType Directory -Force artifacts/prompt042 | Out-Null
docker build -t geochat-backend:verify-042 backend
docker build -t geochat-web:verify-042 apps/web
$out = (Resolve-Path artifacts/prompt042).Path
$scanner = 'geochat-scan-' + [Guid]::NewGuid().ToString('N').Substring(0, 10)
docker run -d --name $scanner --memory 1g --cpus 1 -e GOMEMLIMIT=256MiB --mount "type=bind,src=$out,dst=/out" --entrypoint /bin/sh aquasec/trivy:0.69.3 -c 'sleep 86400'
if ($LASTEXITCODE -ne 0) { throw 'Scanner creation failed' }
try {
    foreach ($name in @('backend', 'web')) {
        $tag = "geochat-${name}:verify-042"
        docker image inspect --format '{{.Id}}' $tag | Set-Content "$out/$name-image-id.txt"
        if ($LASTEXITCODE -ne 0) { throw 'Image inspect failed' }
        docker save --output "$out/$name-image.tar" $tag
        if ($LASTEXITCODE -ne 0) { throw 'Image export failed' }
        docker exec $scanner trivy image --parallel 1 --timeout 20m --cache-dir /tmp/trivy-cache --input "/out/$name-image.tar" --scanners vuln --severity HIGH,CRITICAL --format json --output "/out/$name-scan.json"
        if ($LASTEXITCODE -ne 0) { throw 'Image scan failed' }
        docker exec $scanner trivy image --parallel 1 --timeout 10m --cache-dir /tmp/trivy-cache --input "/out/$name-image.tar" --format cyclonedx --output "/out/$name-sbom.cdx.json"
        if ($LASTEXITCODE -ne 0) { throw 'SBOM generation failed' }
    }
    docker exec $scanner trivy --cache-dir /tmp/trivy-cache --version | Set-Content "$out/scanner-version-db.txt"
    docker cp "${scanner}:/tmp/trivy-cache/db/metadata.json" "$out/trivy-db-metadata.json"
    docker cp "${scanner}:/tmp/trivy-cache/java-db/metadata.json" "$out/trivy-java-db-metadata.json"
} finally { docker rm -f $scanner }
```

Check every native exit code, including builds/metadata copies. Capture stderr in
local logs; Trivy writes informational messages there, so native stderr alone
does not establish failure. `docker save --output` is binary-safe. Archives avoid
Docker socket privileges. The executed run used the pinned scanner with a Docker
socket mount to read the two image tags; the archive procedure avoids that broad
host access. Keep reports/DB metadata before removing the scanner container.

Scan exit zero means execution success, not no findings. Retain unfixable entries:
do not use `--ignore-unfixed`. Record advisory/package/installed/fixed/severity,
runtime exposure, action and residual risk. A release gate can use `--exit-code 1`;
distinguish findings from scanner errors. Match SBOM `aquasecurity:trivy:ImageID`
to the final scan and inspected image, and record artifact hashes.

The current evidence uses a vulnerability DB last updated on 2026-10-16 and a
Java DB updated on 2026-10-17 (UTC). The main DB's NextUpdate was already overdue;
do not describe this as an up-to-date clean scan. On 2026-10-18 the Docker engine
pipe was unavailable, blocking refresh/re-scan. Follow the exact refresh steps in
[the report](release-verification-042.md) before release; retain the old reports
as historical evidence. Web runtime SBOM does not fully inventory bundled JS.

Record database UpdatedAt/DownloadedAt/NextUpdate and source. Downloaded does not
necessarily mean fresh upstream data; re-scan before release. Backend remains
non-root, Web retains its Nginx master/worker user model, no privileged mode or
extra capabilities were added. Existing DB host port remains unchanged. Retain
immutable final IDs and unique release tags; base tags are mutable. Remove patch
BOM overrides when a future Boot BOM includes equal/newer fixed versions.

References: [Trivy databases](https://trivy.dev/docs/latest/configuration/db/),
[Java coverage](https://trivy.dev/docs/latest/coverage/language/java/),
[cache/memory troubleshooting](https://www.trivy.dev/docs/latest/references/troubleshooting/).
