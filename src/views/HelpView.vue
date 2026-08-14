<script setup lang="ts">
/**
 * 帮助页（阶段 7 · 8.10）：旧版为 animate.css 演示 + "todo:帮助"（#6.2），
 * 重写为与新版系统流程一致的使用帮助 FAQ。
 */
import { onMounted } from 'vue'
import { useDocStore } from '@/stores/doc'

const docStore = useDocStore()

onMounted(() => docStore.fetchQqGroup().catch(() => undefined))
</script>

<template>
  <div class="help-page">
    <h2 class="page-title">使用帮助</h2>

    <el-collapse class="faq">
      <el-collapse-item title="电脑医院是什么？" name="1">
        <p>
          电脑医院隶属于浙江工商大学计算机协会，旨在为在校师生提供免费、专业、便捷的IT技术支援服务。常见服务包括：系统问题修复、电脑清灰、病毒扫描、流氓软件清理、重装系统等。
        </p>
      </el-collapse-item>

      <el-collapse-item title="如何注册账号？" name="2">
        <p>
          在登录页切换到「注册」标签，填写账号（建议使用学号，2-50
          位字母/数字/下划线）、昵称和密码（8-64 位）即可。建议同时填写联系方式，便于电医联系你。
        </p>
      </el-collapse-item>

      <el-collapse-item title="如何提交预约？" name="3">
        <p>点击首页「立即预约」，按三步完成：</p>
        <ol>
          <li><b>问题描述</b>：描述你遇到的问题，并选择问题分类；</li>
          <li><b>时间地点</b>：选择期望的维修时间和地点（推荐选项能更快被接单）；</li>
          <li><b>图片与提交</b>：可上传问题截图，确认信息后提交。</li>
        </ol>
        <p>提交后预约进入「排队中」，等待电医接单。</p>
      </el-collapse-item>

      <el-collapse-item title="预约后如何跟进进度？" name="4">
        <p>
          首页「预约记录」可查看全部预约；勾选「仅查看我的记录」只看自己的单。点击卡片进入详情页，
          可通过「预约消息」与电医沟通。预约状态会在 排队中 → 处理中 → 已完成 之间流转。
        </p>
      </el-collapse-item>

      <el-collapse-item title="如何修改或撤销预约？" name="5">
        <p>
          预约处于「排队中」时，本人可在详情页撤销；已被电医接单后不可自行撤销，可在详情页发消息与电医协商。
          若需修改，请联系接单电医或管理员。
        </p>
      </el-collapse-item>

      <el-collapse-item title="忘记密码或密码被重置怎么办？" name="6">
        <p>
          联系管理员重置密码。重置后首次登录会被<b>强制要求修改密码</b>，这是正常的安全流程，修改完成后即可正常使用。
        </p>
      </el-collapse-item>

      <el-collapse-item title="遇到问题如何联系我们？" name="7">
        <p>
          可到「意见反馈」页提交反馈，或加入电脑医院交流群
          <b v-if="docStore.qqGroup">{{ docStore.qqGroup }}</b> 咨询。
        </p>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<style scoped lang="scss">
.help-page {
  max-width: 760px;
  margin: 0 auto;
}

.page-title {
  margin: 4px 0 20px;
  color: var(--el-color-primary);
}

.faq {
  p {
    margin: 8px 0;
    line-height: 1.7;
  }

  ol {
    margin: 8px 0;
    padding-left: 20px;

    li {
      margin: 4px 0;
    }
  }
}
</style>
