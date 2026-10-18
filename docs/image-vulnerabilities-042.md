# PROMPT_042 vulnerability triage

Initial Web runtime: nginx:1.27.4-alpine3.21, image sha256:65546691baed28d84c3890140caf72956d7d108a5fa822a4bacc8bf6854d982e. Scanner Trivy 0.69.3; HIGH/CRITICAL only. Findings describe package advisories, not demonstrated exploitability.

All 49 initial findings below were remediated by switching to Nginx 1.30.6 / Alpine 3.24. Final Web scan: zero HIGH/CRITICAL. Full JSON evidence stays in ignored artifacts/prompt042.

Exposure: Nginx links OS libraries; TLS and image/XML transform features are not enabled in the current HTTP reverse-proxy configuration. Reachability of each vulnerable library path has not been proven. musl/zlib are general runtime dependencies. Removal of reported versions is preferred over relying on these configuration limits.

| Advisory | Package | Installed | Fix available | Severity | Remediation |
|---|---|---|---|---|---|
| CVE-2026-33630 | c-ares | 1.34.3-r0 | 1.34.8-r0 | HIGH | Runtime image refresh; no longer reported |
| CVE-2026-31789 | libcrypto3 | 3.3.3-r0 | 3.3.7-r0 | CRITICAL | Runtime image refresh; no longer reported |
| CVE-2025-15467 | libcrypto3 | 3.3.3-r0 | 3.3.6-r0 | HIGH | Runtime image refresh; no longer reported |
| CVE-2025-69421 | libcrypto3 | 3.3.3-r0 | 3.3.6-r0 | HIGH | Runtime image refresh; no longer reported |
| CVE-2026-28387 | libcrypto3 | 3.3.3-r0 | 3.3.7-r0 | HIGH | Runtime image refresh; no longer reported |
| CVE-2026-28388 | libcrypto3 | 3.3.3-r0 | 3.3.7-r0 | HIGH | Runtime image refresh; no longer reported |
| CVE-2026-28389 | libcrypto3 | 3.3.3-r0 | 3.3.7-r0 | HIGH | Runtime image refresh; no longer reported |
| CVE-2026-28390 | libcrypto3 | 3.3.3-r0 | 3.3.7-r0 | HIGH | Runtime image refresh; no longer reported |
| CVE-2026-45447 | libcrypto3 | 3.3.3-r0 | 3.3.7-r1 | HIGH | Runtime image refresh; no longer reported |
| CVE-2026-84782 | libcrypto3 | 3.3.3-r0 | 3.3.7-r2 | HIGH | Runtime image refresh; no longer reported |
| CVE-2025-59375 | libexpat | 2.6.4-r0 | 2.7.2-r0 | HIGH | Runtime image refresh; no longer reported |
| CVE-2026-25210 | libexpat | 2.6.4-r0 | 2.7.4-r0 | HIGH | Runtime image refresh; no longer reported |
| CVE-2026-45186 | libexpat | 2.6.4-r0 | 2.8.1-r0 | HIGH | Runtime image refresh; no longer reported |
| CVE-2026-66046 | libexpat | 2.6.4-r0 | 2.8.4-r0 | HIGH | Runtime image refresh; no longer reported |
| CVE-2026-76641 | libexpat | 2.6.4-r0 | 2.8.4-r0 | HIGH | Runtime image refresh; no longer reported |
| CVE-2026-76956 | libexpat | 2.6.4-r0 | 2.8.4-r0 | HIGH | Runtime image refresh; no longer reported |
| CVE-2026-76957 | libexpat | 2.6.4-r0 | 2.8.4-r0 | HIGH | Runtime image refresh; no longer reported |
| CVE-2025-64720 | libpng | 1.6.44-r0 | 1.6.53-r0 | HIGH | Runtime image refresh; no longer reported |
| CVE-2025-65018 | libpng | 1.6.44-r0 | 1.6.53-r0 | HIGH | Runtime image refresh; no longer reported |
| CVE-2025-66293 | libpng | 1.6.44-r0 | 1.6.53-r0 | HIGH | Runtime image refresh; no longer reported |
| CVE-2026-22695 | libpng | 1.6.44-r0 | 1.6.54-r0 | HIGH | Runtime image refresh; no longer reported |
| CVE-2026-22801 | libpng | 1.6.44-r0 | 1.6.54-r0 | HIGH | Runtime image refresh; no longer reported |
| CVE-2026-25646 | libpng | 1.6.44-r0 | 1.6.55-r0 | HIGH | Runtime image refresh; no longer reported |
| CVE-2026-31789 | libssl3 | 3.3.3-r0 | 3.3.7-r0 | CRITICAL | Runtime image refresh; no longer reported |
| CVE-2025-15467 | libssl3 | 3.3.3-r0 | 3.3.6-r0 | HIGH | Runtime image refresh; no longer reported |
| CVE-2025-69421 | libssl3 | 3.3.3-r0 | 3.3.6-r0 | HIGH | Runtime image refresh; no longer reported |
| CVE-2026-28387 | libssl3 | 3.3.3-r0 | 3.3.7-r0 | HIGH | Runtime image refresh; no longer reported |
| CVE-2026-28388 | libssl3 | 3.3.3-r0 | 3.3.7-r0 | HIGH | Runtime image refresh; no longer reported |
| CVE-2026-28389 | libssl3 | 3.3.3-r0 | 3.3.7-r0 | HIGH | Runtime image refresh; no longer reported |
| CVE-2026-28390 | libssl3 | 3.3.3-r0 | 3.3.7-r0 | HIGH | Runtime image refresh; no longer reported |
| CVE-2026-45447 | libssl3 | 3.3.3-r0 | 3.3.7-r1 | HIGH | Runtime image refresh; no longer reported |
| CVE-2026-84782 | libssl3 | 3.3.3-r0 | 3.3.7-r2 | HIGH | Runtime image refresh; no longer reported |
| CVE-2024-56171 | libxml2 | 2.13.4-r3 | 2.13.4-r4 | CRITICAL | Runtime image refresh; no longer reported |
| CVE-2025-24928 | libxml2 | 2.13.4-r3 | 2.13.4-r4 | HIGH | Runtime image refresh; no longer reported |
| CVE-2025-27113 | libxml2 | 2.13.4-r3 | 2.13.4-r5 | HIGH | Runtime image refresh; no longer reported |
| CVE-2025-32414 | libxml2 | 2.13.4-r3 | 2.13.4-r6 | HIGH | Runtime image refresh; no longer reported |
| CVE-2025-32415 | libxml2 | 2.13.4-r3 | 2.13.4-r6 | HIGH | Runtime image refresh; no longer reported |
| CVE-2025-49794 | libxml2 | 2.13.4-r3 | 2.13.9-r0 | HIGH | Runtime image refresh; no longer reported |
| CVE-2025-49795 | libxml2 | 2.13.4-r3 | 2.13.9-r0 | HIGH | Runtime image refresh; no longer reported |
| CVE-2025-49796 | libxml2 | 2.13.4-r3 | 2.13.9-r0 | HIGH | Runtime image refresh; no longer reported |
| CVE-2026-6732 | libxml2 | 2.13.4-r3 | 2.13.9-r1 | HIGH | Runtime image refresh; no longer reported |
| CVE-2024-55549 | libxslt | 1.1.42-r1 | 1.1.42-r2 | HIGH | Runtime image refresh; no longer reported |
| CVE-2025-24855 | libxslt | 1.1.42-r1 | 1.1.42-r2 | HIGH | Runtime image refresh; no longer reported |
| CVE-2026-40200 | musl | 1.2.5-r9 | 1.2.5-r11 | HIGH | Runtime image refresh; no longer reported |
| CVE-2026-40200 | musl-utils | 1.2.5-r9 | 1.2.5-r11 | HIGH | Runtime image refresh; no longer reported |
| CVE-2026-27135 | nghttp2-libs | 1.64.0-r0 | 1.68.1 | HIGH | Runtime image refresh; no longer reported |
| CVE-2026-4775 | tiff | 4.7.0-r0 | 4.7.2-r0 | HIGH | Runtime image refresh; no longer reported |
| CVE-2025-31115 | xz-libs | 5.6.3-r0 | 5.6.3-r1 | HIGH | Runtime image refresh; no longer reported |
| CVE-2026-22184 | zlib | 1.3.1-r2 | 1.3.2-r0 | HIGH | Runtime image refresh; no longer reported |

## Backend

Initial image: sha256:1ba509d6909cca0878a28c3a776518530738b4d5b22fe7696242f398cf683c47. 17 findings were remediated by explicit same-line patch versions and an updated libssl3 runtime package. Final Backend scan: zero HIGH/CRITICAL.

Exposure: Tomcat and Spring MVC process incoming proxied HTTP requests; Jackson parses API payloads. PostgreSQL JDBC communicates with the configured database server. libssl3 supports TLS-capable runtime utilities. Advisory presence does not demonstrate that a vulnerable option or input path is enabled. Regression tests and the disposable outage/restore drill validate compatibility; no application major versions were upgraded.

| Advisory | Package | Installed | Fix available | Severity | Remediation |
|---|---|---|---|---|---|
| CVE-2026-84782 | libssl3 | 3.0.2-0ubuntu1.29 | 3.0.2-0ubuntu1.30 | HIGH | Same-line patch/runtime refresh; no longer reported |
| CVE-2026-89407 | com.fasterxml.jackson.core:jackson-core | 2.21.4 | 2.18.11, 2.21.7, 2.22.3 | HIGH | Same-line patch/runtime refresh; no longer reported |
| CVE-2026-89425 | com.fasterxml.jackson.core:jackson-core | 2.21.4 | 2.21.7, 2.22.3, 2.18.11 | HIGH | Same-line patch/runtime refresh; no longer reported |
| CVE-2026-68497 | com.fasterxml.jackson.core:jackson-databind | 2.21.4 | 2.18.10, 2.21.6, 2.22.2 | HIGH | Same-line patch/runtime refresh; no longer reported |
| CVE-2026-91776 | com.fasterxml.jackson.core:jackson-databind | 2.21.4 | 2.18.11, 2.21.7, 2.22.3 | HIGH | Same-line patch/runtime refresh; no longer reported |
| CVE-2026-91777 | com.fasterxml.jackson.core:jackson-databind | 2.21.4 | 2.21.7, 2.18.11, 2.22.3 | HIGH | Same-line patch/runtime refresh; no longer reported |
| CVE-2026-65182 | org.apache.tomcat.embed:tomcat-embed-core | 11.0.22 | 11.0.25, 10.1.58, 9.0.121 | CRITICAL | Same-line patch/runtime refresh; no longer reported |
| CVE-2026-65905 | org.apache.tomcat.embed:tomcat-embed-core | 11.0.22 | 11.0.25, 10.1.58, 9.0.121 | CRITICAL | Same-line patch/runtime refresh; no longer reported |
| CVE-2026-68525 | org.apache.tomcat.embed:tomcat-embed-core | 11.0.22 | 11.0.25, 10.1.58, 9.0.121 | CRITICAL | Same-line patch/runtime refresh; no longer reported |
| CVE-2026-54291 | org.postgresql:postgresql | 42.7.11 | 42.7.12 | HIGH | Same-line patch/runtime refresh; no longer reported |
| CVE-2026-47884 | org.springframework:spring-webmvc | 7.0.8 | 7.0.9 | CRITICAL | Same-line patch/runtime refresh; no longer reported |
| CVE-2026-47890 | org.springframework:spring-webmvc | 7.0.8 | 7.0.9 | CRITICAL | Same-line patch/runtime refresh; no longer reported |
| CVE-2026-89407 | tools.jackson.core:jackson-core | 3.1.4 | 3.1.7, 3.2.2 | HIGH | Same-line patch/runtime refresh; no longer reported |
| CVE-2026-89425 | tools.jackson.core:jackson-core | 3.1.4 | 3.1.7, 3.2.3 | HIGH | Same-line patch/runtime refresh; no longer reported |
| CVE-2026-68497 | tools.jackson.core:jackson-databind | 3.1.4 | 3.2.2, 3.1.6 | HIGH | Same-line patch/runtime refresh; no longer reported |
| CVE-2026-91776 | tools.jackson.core:jackson-databind | 3.1.4 | 3.1.7, 3.2.3 | HIGH | Same-line patch/runtime refresh; no longer reported |
| CVE-2026-91777 | tools.jackson.core:jackson-databind | 3.1.4 | 3.1.7, 3.2.3 | HIGH | Same-line patch/runtime refresh; no longer reported |

Patch targets: Spring Framework 7.0.9, Tomcat 11.0.25, PostgreSQL JDBC 42.7.12, Jackson 2 BOM 2.21.7 and Jackson 3 BOM 3.1.7. libssl3 is explicitly installed at the current Ubuntu repository candidate. Remove overrides once the Spring Boot BOM includes equal or newer fixed versions. There are no remaining HIGH/CRITICAL findings in either final report, including findings without listed fixes. Lower severities were outside this scan filter.

Upstream references: [NGINX advisories](https://nginx.org/en/security_advisories.html), [Spring Framework releases](https://github.com/spring-projects/spring-framework/releases). The exact scanner database snapshot and image identifiers are recorded in release-verification-042.md.
