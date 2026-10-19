package com.geochat.user.controller;

import java.time.Instant;
import com.geochat.common.response.ApiResponse;
import com.geochat.user.service.AdminQueries;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/audit-logs")
public class AdminAuditController {
    private final AdminQueries queries;
    public AdminAuditController(AdminQueries queries) { this.queries=queries; }
    @GetMapping
    public ApiResponse<AdminQueries.Page<AdminQueries.Audit>> list(@RequestParam(required=false) String action,
            @RequestParam(required=false) Long actor, @RequestParam(required=false) Long target,
            @RequestParam(required=false) Instant after,@RequestParam(required=false) Instant before,
            @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size,
            jakarta.servlet.http.HttpServletResponse response) {
        response.setHeader("Cache-Control","no-store");
        return ApiResponse.ok(queries.audit(action,actor,target,after,before,page,size));
    }
}
