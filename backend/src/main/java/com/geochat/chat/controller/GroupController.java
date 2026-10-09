package com.geochat.chat.controller;

import com.geochat.chat.dto.AddGroupMembersRequest;
import com.geochat.chat.dto.ChatDtos.GroupInfoResponse;
import com.geochat.chat.dto.ChatDtos.GroupMembersResponse;
import com.geochat.chat.dto.CreateGroupRequest;
import com.geochat.chat.dto.RenameGroupRequest;
import com.geochat.chat.service.GroupService;
import com.geochat.common.response.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/groups")
public class GroupController {

    private final GroupService groupService;

    public GroupController(GroupService groupService) {
        this.groupService = groupService;
    }

    @PostMapping
    public ApiResponse<GroupInfoResponse> createGroup(@AuthenticationPrincipal UserDetails principal,
                                                       @Valid @RequestBody CreateGroupRequest request) {
        return ApiResponse.ok(groupService.createGroup(principal.getUsername(), request));
    }

    @GetMapping("/{groupId}")
    public ApiResponse<GroupInfoResponse> getGroup(@AuthenticationPrincipal UserDetails principal,
                                                    @PathVariable Long groupId) {
        return ApiResponse.ok(groupService.getGroup(principal.getUsername(), groupId));
    }

    @PatchMapping("/{groupId}")
    public ApiResponse<GroupInfoResponse> renameGroup(@AuthenticationPrincipal UserDetails principal,
                                                       @PathVariable Long groupId,
                                                       @Valid @RequestBody RenameGroupRequest request) {
        return ApiResponse.ok(groupService.renameGroup(principal.getUsername(), groupId, request));
    }

    @DeleteMapping("/{groupId}")
    public ApiResponse<Void> deleteGroup(@AuthenticationPrincipal UserDetails principal,
                                         @PathVariable Long groupId) {
        groupService.deleteGroup(principal.getUsername(), groupId);
        return ApiResponse.ok(null);
    }

    @GetMapping("/{groupId}/members")
    public ApiResponse<GroupMembersResponse> getMembers(@AuthenticationPrincipal UserDetails principal,
                                                        @PathVariable Long groupId) {
        return ApiResponse.ok(groupService.getMembers(principal.getUsername(), groupId));
    }

    @PostMapping("/{groupId}/members")
    public ApiResponse<GroupInfoResponse> addMembers(@AuthenticationPrincipal UserDetails principal,
                                                     @PathVariable Long groupId,
                                                     @Valid @RequestBody AddGroupMembersRequest request) {
        return ApiResponse.ok(groupService.addMembers(principal.getUsername(), groupId, request));
    }

    @DeleteMapping("/{groupId}/members/{memberId}")
    public ApiResponse<GroupInfoResponse> removeMember(@AuthenticationPrincipal UserDetails principal,
                                                       @PathVariable Long groupId,
                                                       @PathVariable Long memberId) {
        return ApiResponse.ok(groupService.removeMember(principal.getUsername(), groupId, memberId));
    }

    @DeleteMapping("/{groupId}/members/me")
    public ApiResponse<Void> leaveGroup(@AuthenticationPrincipal UserDetails principal,
                                        @PathVariable Long groupId) {
        groupService.leaveGroup(principal.getUsername(), groupId);
        return ApiResponse.ok(null);
    }
}