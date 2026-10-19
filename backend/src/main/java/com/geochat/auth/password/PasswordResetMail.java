package com.geochat.auth.password;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

@Component
public class PasswordResetMail {
    private final ObjectProvider<JavaMailSender> sender;
    private final String from;
    private final String host;
    public PasswordResetMail(ObjectProvider<JavaMailSender> sender, @Value("${app.password-reset.from:}") String from,
                             @Value("${spring.mail.host:}") String host) {
        this.sender = sender; this.from = from; this.host = host;
    }
    public boolean available() { return sender.getIfAvailable() != null && !from.isBlank() && !host.isBlank(); }
    public void send(String email, String url) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from); message.setTo(email);
        message.setSubject("GeoChat - Đặt lại mật khẩu / Reset your password");
        message.setText("Use this link within 15 minutes to reset your GeoChat password:\n"
                + "Sử dụng liên kết trong 15 phút để đặt lại mật khẩu GeoChat:\n\n" + url
                + "\n\nIf you did not request this, ignore this email. / Nếu bạn không yêu cầu, hãy bỏ qua email này.");
        sender.getObject().send(message);
    }
}
