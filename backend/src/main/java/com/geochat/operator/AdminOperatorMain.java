package com.geochat.operator;

import com.geochat.user.entity.User;
import com.geochat.user.repository.UserRepository;
import com.geochat.user.service.AdminProvisioning;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.persistence.autoconfigure.EntityScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Profile;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/** Separate entry point: does not scan Web controllers, provider clients or public provisioning APIs. */
@Configuration
@Profile("admin-operator")
@EnableAutoConfiguration
@EntityScan(basePackageClasses=User.class)
@EnableJpaRepositories(basePackageClasses=UserRepository.class)
@Import(AdminProvisioning.class)
public class AdminOperatorMain {
    public static void main(String[] args) {
        try(var context=new SpringApplicationBuilder(AdminOperatorMain.class).profiles("admin-operator").web(WebApplicationType.NONE).run(args)) {
            var env=context.getEnvironment();
            if(!env.getProperty("app.admin-operator.enabled",Boolean.class,false))
                throw new IllegalStateException("Explicitly enable the one-shot Admin operator command.");
            context.getBean(AdminProvisioning.class).change(env.getRequiredProperty("app.admin-operator.user-id",Long.class),
                    env.getRequiredProperty("app.admin-operator.action"),env.getRequiredProperty("app.admin-operator.confirmation"),
                    env.getRequiredProperty("app.admin-operator.reason"));
        }
    }
}
