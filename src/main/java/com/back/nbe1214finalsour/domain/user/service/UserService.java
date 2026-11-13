package com.back.nbe1214finalsour.domain.user.service;

import com.back.nbe1214finalsour.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserService {

    private final UserRepository userRepository;

    /** 탈퇴하지 않은 회원 중에 대소문자를 무시하고 같은 닉네임이 없으면 사용할 수 있다 */
    public boolean isNicknameAvailable(String nickname) {
        return !userRepository.existsActiveNicknameIgnoreCase(nickname);
    }
}
