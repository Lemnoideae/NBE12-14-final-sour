package com.back.nbe1214finalsour.domain.item.controller;

import com.back.nbe1214finalsour.domain.item.dto.ItemResponse;
import com.back.nbe1214finalsour.domain.item.service.ItemService;
import com.back.nbe1214finalsour.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/items")
@RequiredArgsConstructor
public class ItemController {

    private final ItemService itemService;

    @GetMapping
    public ApiResponse<List<ItemResponse>> getItems(){
        List<ItemResponse> items = this.itemService.getItems().stream()
                .map(ItemResponse::new)
                .toList();

        return ApiResponse.ok(items);
    }

}
