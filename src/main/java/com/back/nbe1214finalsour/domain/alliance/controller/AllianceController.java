package com.back.nbe1214finalsour.domain.alliance.controller;

import com.back.nbe1214finalsour.domain.alliance.dto.AllianceCreateRequest;
import com.back.nbe1214finalsour.domain.alliance.dto.AllianceResponse;
import com.back.nbe1214finalsour.domain.alliance.service.AllianceQueryService;
import com.back.nbe1214finalsour.domain.alliance.service.AllianceService;
import com.back.nbe1214finalsour.global.response.ApiResponse;
import com.back.nbe1214finalsour.global.security.AuthUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/alliances")
public class AllianceController {

    private final AllianceService allianceService;
    private final AllianceQueryService allianceQueryService;

    @GetMapping("/{allianceId}")
    public ApiResponse<AllianceResponse> getAlliance(@PathVariable Long allianceId) {
        return ApiResponse.ok(new AllianceResponse(allianceQueryService.getAlliance(allianceId)));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<AllianceResponse> createAlliance(
            @AuthenticationPrincipal AuthUser authUser,
            @Valid @RequestBody AllianceCreateRequest request
    ) {
        return ApiResponse.ok(new AllianceResponse(
                allianceService.createAlliance(authUser.userId(), request.name(), request.durationHours())
        ));
    }
}
