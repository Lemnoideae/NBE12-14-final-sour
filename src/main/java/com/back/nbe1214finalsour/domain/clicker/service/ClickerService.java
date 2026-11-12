package com.back.nbe1214finalsour.domain.clicker.service;

import com.back.nbe1214finalsour.domain.clicker.entity.Clicker;
import com.back.nbe1214finalsour.domain.clicker.repository.ClickerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ClickerService {
    private final ClickerRepository clickerRepository;

    public List<Clicker> getLevelTable() {
        return this.clickerRepository.findAllByOrderByIdAsc();
    }
}
