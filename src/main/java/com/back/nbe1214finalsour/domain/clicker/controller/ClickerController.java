package com.back.nbe1214finalsour.domain.clicker.controller;

import com.back.nbe1214finalsour.domain.clicker.dto.ClickerResponse;
import com.back.nbe1214finalsour.domain.clicker.entity.Clicker;
import com.back.nbe1214finalsour.domain.clicker.service.ClickerService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/clickers")
public class ClickerController {

    private final ClickerService clickerService;


    @GetMapping
    public List<ClickerResponse> getLevelTable() {
        return this.clickerService.getLevelTable().stream()
                .map(ClickerResponse::new)
                .toList();
    }
}
